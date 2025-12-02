/**
 * FeedbackForm Component
 *
 * Multi-page feedback completion form component that renders feedback questionnaires
 * with question items, page navigation, progress indication, anonymous submission
 * support, and comprehensive form validation.
 *
 * Features:
 * - Multi-page form navigation with MUI Stepper progress indicator
 * - React Hook Form with Zod schema validation
 * - QuestionRenderer delegation for different question types
 * - Save draft functionality with autosave (every 60 seconds)
 * - Final review page before submission
 * - Anonymous and non-anonymous submission support
 * - Full keyboard navigation (Tab, Enter)
 * - Screen reader support with aria-live regions
 * - Retry capability for failed submissions
 *
 * @module features/activities/feedback/components/FeedbackForm
 * @see public/mod/feedback/complete.php - PHP feedback completion page
 * @see public/mod/feedback/classes/complete_form.php - PHP form implementation
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller, type FieldValues } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Stepper,
  Step,
  StepLabel,
  Button,
  Box,
  Typography,
  CircularProgress,
  FormHelperText,
  LinearProgress,
  Paper,
  Divider,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import {
  NavigateBefore,
  NavigateNext,
  Save,
  Send,
  CheckCircle,
} from '@mui/icons-material';

import { QuestionRenderer } from './QuestionRenderer';
import type { FeedbackItem, FeedbackItemPresentation, FeedbackResponse } from '../types';
import { submitFeedbackResponse, saveProgress, type FeedbackResponses } from '../api/feedbackApi';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/feedback/Alert';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * State interface for tracking page navigation and validation status.
 * Used to manage multi-page form progression.
 */
export interface PageState {
  /** Current page index (0-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether each page has been validated */
  validatedPages: boolean[];
  /** Whether currently showing the review page */
  isReviewPage: boolean;
}

/**
 * Extended feedback item with parsed presentation data.
 * Used internally for rendering questions.
 */
interface ParsedFeedbackItem extends Omit<FeedbackItem, 'presentation'> {
  /** Parsed presentation configuration */
  presentation: FeedbackItemPresentation;
  /** Original presentation string for reference */
  presentationRaw: string;
}

/**
 * Page data structure grouping items by page.
 */
interface PageData {
  /** Page index (0-based) */
  pageIndex: number;
  /** Items on this page */
  items: ParsedFeedbackItem[];
  /** Page label (optional) */
  label?: string;
}

/**
 * Props interface for the FeedbackForm component.
 */
export interface FeedbackFormProps {
  /** Unique identifier for the feedback activity */
  feedbackId: number;

  /** Array of feedback items/questions, may include pagebreaks */
  items: FeedbackItem[];

  /** Whether the feedback is anonymous (hides user identification) */
  isAnonymous: boolean;

  /** Whether the user can submit the feedback */
  canSubmit: boolean;

  /**
   * Callback fired on successful submission.
   * @param response - The submission response data
   */
  onSubmit?: (response: FeedbackResponse) => void;

  /**
   * Callback fired when user cancels/exits the form.
   */
  onCancel?: () => void;

  /**
   * Optional course ID for site-wide feedback mapping.
   */
  courseId?: number;

  /**
   * Previously saved responses for resuming a draft.
   */
  savedResponses?: Record<number, string | number | string[]>;

  /**
   * Page to resume from (for multi-page feedback).
   */
  resumePage?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parses the presentation string from a feedback item into structured data.
 * Different question types have different presentation formats.
 *
 * @param item - The feedback item to parse
 * @returns Parsed presentation configuration
 */
function parsePresentation(item: FeedbackItem): FeedbackItemPresentation {
  const basePresentation: FeedbackItemPresentation = {
    type: item.typ,
  };

  if (!item.presentation) {
    return basePresentation;
  }

  try {
    switch (item.typ) {
      case 'multichoice':
      case 'multichoicerated': {
        // Format: "r>>>>>option1|option2|option3" or "c>>>>>option1|option2"
        // r = radio, c = checkbox, d = dropdown
        const parts = item.presentation.split('>>>>>');
        const subtype = (parts[0] || 'r') as 'r' | 'c' | 'd';
        const optionsPart = parts[1] || '';

        if (item.typ === 'multichoicerated') {
          // Rated options have format: "value####text"
          const options = optionsPart.split('|').map(opt => {
            const [valuePart, textPart] = opt.split('####');
            return {
              text: textPart || opt,
              value: parseInt(valuePart, 10) || 0,
            };
          });
          return {
            ...basePresentation,
            multichoicerated: {
              subtype: subtype === 'c' ? 'r' : subtype as 'r' | 'd',
              options,
            },
          };
        }

        const options = optionsPart.split('|').filter(Boolean);
        return {
          ...basePresentation,
          multichoice: {
            subtype,
            randomize: item.options?.includes('h') ?? false,
            hideNotSelected: item.options?.includes('n') ?? false,
            ignoreEmpty: item.options?.includes('i') ?? false,
            options,
          },
        };
      }

      case 'numeric': {
        // Format: "min|max" or just accept any number
        const [rangeFrom, rangeTo] = item.presentation.split('|').map(Number);
        return {
          ...basePresentation,
          numeric: {
            rangeFrom: isNaN(rangeFrom) ? 0 : rangeFrom,
            rangeTo: isNaN(rangeTo) ? 100 : rangeTo,
          },
        };
      }

      case 'textfield':
      case 'textarea': {
        // Format: "width" or "width|maxlength" for textfield
        // Format: "width|height" for textarea
        const [width, heightOrMax] = item.presentation.split('|').map(Number);
        return {
          ...basePresentation,
          text: {
            width: isNaN(width) ? 50 : width,
            ...(item.typ === 'textarea'
              ? { rows: isNaN(heightOrMax) ? 5 : heightOrMax }
              : { maxLength: heightOrMax }),
          },
        };
      }

      case 'info':
      case 'label': {
        return {
          ...basePresentation,
          info: {
            content: item.presentation,
          },
        };
      }

      default:
        return basePresentation;
    }
  } catch {
    return basePresentation;
  }
}

/**
 * Groups feedback items into pages based on pagebreak items.
 *
 * @param items - Array of feedback items
 * @returns Array of page data structures
 */
function groupItemsByPages(items: FeedbackItem[]): PageData[] {
  const pages: PageData[] = [];
  let currentPage: ParsedFeedbackItem[] = [];
  let pageIndex = 0;

  for (const item of items) {
    if (item.typ === 'pagebreak') {
      // Start a new page when encountering a pagebreak
      if (currentPage.length > 0) {
        pages.push({
          pageIndex,
          items: currentPage,
          label: `Page ${pageIndex + 1}`,
        });
        pageIndex++;
        currentPage = [];
      }
    } else {
      // Add item to current page with parsed presentation
      const parsedItem: ParsedFeedbackItem = {
        ...item,
        presentation: parsePresentation(item),
        presentationRaw: item.presentation,
      };
      currentPage.push(parsedItem);
    }
  }

  // Add the last page if it has items
  if (currentPage.length > 0) {
    pages.push({
      pageIndex,
      items: currentPage,
      label: `Page ${pageIndex + 1}`,
    });
  }

  // If no pages were created (no pagebreaks), create a single page
  if (pages.length === 0 && items.length > 0) {
    pages.push({
      pageIndex: 0,
      items: items
        .filter(item => item.typ !== 'pagebreak')
        .map(item => ({
          ...item,
          presentation: parsePresentation(item),
          presentationRaw: item.presentation,
        })),
      label: 'Page 1',
    });
  }

  return pages;
}

/**
 * Creates a Zod validation schema for the given items.
 * Required items get required validators, optional items get optional validators.
 *
 * @param items - Array of feedback items to create schema for
 * @returns Zod schema object
 */
function createValidationSchema(
  items: ParsedFeedbackItem[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  for (const item of items) {
    // Skip non-value items (labels, info, pagebreaks)
    if (!item.hasvalue || item.typ === 'info' || item.typ === 'label' || item.typ === 'pagebreak') {
      continue;
    }

    const fieldKey = `item_${item.id}`;
    const isRequired = item.required === 1;

    switch (item.typ) {
      case 'numeric': {
        const numericPresentation = item.presentation.numeric;
        let numericSchema = z.coerce.number();

        if (numericPresentation) {
          numericSchema = numericSchema
            .min(
              numericPresentation.rangeFrom,
              `Value must be at least ${numericPresentation.rangeFrom}`
            )
            .max(
              numericPresentation.rangeTo,
              `Value must be at most ${numericPresentation.rangeTo}`
            );
        }

        schemaFields[fieldKey] = isRequired
          ? numericSchema
          : z.union([numericSchema, z.literal(''), z.undefined()]).optional();
        break;
      }

      case 'multichoice': {
        const multichoicePresentation = item.presentation.multichoice;
        if (multichoicePresentation?.subtype === 'c') {
          // Checkbox - array of strings
          schemaFields[fieldKey] = isRequired
            ? z.array(z.string()).min(1, 'Please select at least one option')
            : z.array(z.string()).optional();
        } else {
          // Radio or dropdown - single string
          schemaFields[fieldKey] = isRequired
            ? z.string().min(1, 'Please select an option')
            : z.string().optional();
        }
        break;
      }

      case 'multichoicerated': {
        schemaFields[fieldKey] = isRequired
          ? z.string().min(1, 'Please select an option')
          : z.string().optional();
        break;
      }

      case 'textarea':
      case 'textfield':
      default: {
        const textPresentation = item.presentation.text;
        let textSchema = z.string();

        if (textPresentation?.maxLength) {
          textSchema = textSchema.max(
            textPresentation.maxLength,
            `Maximum ${textPresentation.maxLength} characters allowed`
          );
        }

        schemaFields[fieldKey] = isRequired
          ? textSchema.min(1, 'This field is required')
          : textSchema.optional();
        break;
      }
    }
  }

  return z.object(schemaFields);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Autosave interval in milliseconds (60 seconds) */
const AUTOSAVE_INTERVAL = 60000;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * FeedbackForm Component
 *
 * Renders a multi-page feedback questionnaire form with full validation,
 * page navigation, and submission handling.
 *
 * @example
 * ```tsx
 * <FeedbackForm
 *   feedbackId={42}
 *   items={feedbackItems}
 *   isAnonymous={true}
 *   canSubmit={true}
 *   onSubmit={(response) => console.log('Submitted:', response)}
 * />
 * ```
 */
export function FeedbackForm({
  feedbackId,
  items,
  isAnonymous,
  canSubmit,
  onSubmit,
  onCancel,
  courseId,
  savedResponses,
  resumePage = 0,
}: FeedbackFormProps): React.JSX.Element {
  // ============================================================================
  // HOOKS AND STATE
  // ============================================================================

  const toast = useToast();

  // Group items into pages
  const pages = useMemo(() => groupItemsByPages(items), [items]);

  // Get all items across all pages for full validation schema
  const allItems = useMemo(
    () => pages.flatMap(page => page.items),
    [pages]
  );

  // Create combined validation schema for all items
  const validationSchema = useMemo(
    () => createValidationSchema(allItems),
    [allItems]
  );

  // Page navigation state
  const [pageState, setPageState] = useState<PageState>({
    currentPage: Math.min(resumePage, pages.length - 1),
    totalPages: pages.length,
    validatedPages: new Array(pages.length).fill(false),
    isReviewPage: false,
  });

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submissionResponse, setSubmissionResponse] = useState<FeedbackResponse | null>(null);

  // Last autosave timestamp for tracking
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);

  // Screen reader announcements
  const [announcement, setAnnouncement] = useState<string>('');

  // Build default values from saved responses
  const defaultValues = useMemo(() => {
    const values: Record<string, string | number | string[]> = {};
    
    // Initialize all fields with empty/default values
    for (const item of allItems) {
      if (!item.hasvalue || item.typ === 'info' || item.typ === 'label') {
        continue;
      }
      
      const fieldKey = `item_${item.id}`;
      const savedValue = savedResponses?.[item.id];

      if (savedValue !== undefined) {
        values[fieldKey] = savedValue;
      } else if (item.presentation.multichoice?.subtype === 'c') {
        values[fieldKey] = [];
      } else {
        values[fieldKey] = '';
      }
    }

    return values;
  }, [allItems, savedResponses]);

  // Initialize React Hook Form
  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, touchedFields, isDirty },
    watch,
  } = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
    mode: 'onBlur',
  });

  // Watch all form values for autosave
  const formValues = watch();

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Announces a message to screen readers using aria-live region.
   */
  const announce = useCallback((message: string) => {
    setAnnouncement('');
    // Use setTimeout to ensure the announcement is re-read
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  /**
   * Validates the current page fields.
   * @returns Promise resolving to whether validation passed
   */
  const validateCurrentPage = useCallback(async (): Promise<boolean> => {
    const currentPageItems = pages[pageState.currentPage]?.items || [];
    const fieldsToValidate = currentPageItems
      .filter(item => item.hasvalue && item.typ !== 'info' && item.typ !== 'label')
      .map(item => `item_${item.id}`);

    if (fieldsToValidate.length === 0) {
      return true;
    }

    const isValid = await trigger(fieldsToValidate as (keyof FieldValues)[]);
    return isValid;
  }, [pages, pageState.currentPage, trigger]);

  /**
   * Navigates to the previous page.
   */
  const handlePreviousPage = useCallback(() => {
    if (pageState.currentPage > 0 || pageState.isReviewPage) {
      const newPage = pageState.isReviewPage
        ? pageState.totalPages - 1
        : pageState.currentPage - 1;
      
      setPageState(prev => ({
        ...prev,
        currentPage: newPage,
        isReviewPage: false,
      }));
      
      announce(`Navigated to page ${newPage + 1} of ${pageState.totalPages}`);
      setSubmitError(null);
    }
  }, [pageState, announce]);

  /**
   * Navigates to the next page after validating current page.
   */
  const handleNextPage = useCallback(async () => {
    const isValid = await validateCurrentPage();

    if (!isValid) {
      const errorCount = Object.keys(errors).length;
      announce(`Validation failed. Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} before continuing.`);
      toast.warning('Please fill in all required fields before continuing.');
      return;
    }

    // Mark current page as validated
    setPageState(prev => {
      const newValidatedPages = [...prev.validatedPages];
      newValidatedPages[prev.currentPage] = true;

      if (prev.currentPage < prev.totalPages - 1) {
        // Go to next page
        announce(`Navigated to page ${prev.currentPage + 2} of ${prev.totalPages}`);
        return {
          ...prev,
          currentPage: prev.currentPage + 1,
          validatedPages: newValidatedPages,
        };
      } else {
        // Go to review page
        announce('All pages completed. Please review your answers before submitting.');
        return {
          ...prev,
          validatedPages: newValidatedPages,
          isReviewPage: true,
        };
      }
    });

    setSubmitError(null);
  }, [validateCurrentPage, errors, announce, toast]);

  /**
   * Saves the current form state as a draft.
   */
  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    setSubmitError(null);

    try {
      const values = getValues();
      const responses: FeedbackResponses = {};

      // Convert form values to API format
      for (const [key, value] of Object.entries(values)) {
        if (key.startsWith('item_')) {
          const itemId = parseInt(key.replace('item_', ''), 10);
          if (!isNaN(itemId) && value !== undefined && value !== '') {
            responses[itemId] = value as string | number | string[];
          }
        }
      }

      // Add current page info
      responses.gopage = pageState.currentPage;
      if (courseId) {
        responses.courseid = courseId;
      }

      const result = await saveProgress(feedbackId, responses);

      if (result.success) {
        setLastAutoSave(new Date());
        toast.success('Draft saved successfully.');
        announce('Your progress has been saved.');
      } else {
        throw new Error('Failed to save draft');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save draft. Please try again.';
      toast.error(errorMessage);
      announce('Failed to save draft. Please try again.');
    } finally {
      setIsSavingDraft(false);
    }
  }, [getValues, feedbackId, pageState.currentPage, courseId, toast, announce]);

  /**
   * Submits the completed feedback form.
   */
  const handleFormSubmit = useCallback(async (data: FieldValues) => {
    if (!canSubmit) {
      toast.error('You do not have permission to submit this feedback.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const responses: FeedbackResponses = {};

      // Convert form values to API format
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('item_')) {
          const itemId = parseInt(key.replace('item_', ''), 10);
          if (!isNaN(itemId) && value !== undefined && value !== '') {
            responses[itemId] = value as string | number | string[];
          }
        }
      }

      // Add course ID if provided
      if (courseId) {
        responses.courseid = courseId;
      }

      const result = await submitFeedbackResponse(feedbackId, responses);

      if (result.success && result.data) {
        setIsSubmitSuccess(true);
        
        // Create a FeedbackResponse object for the callback
        const response: FeedbackResponse = {
          completed: {
            id: result.data.completedId,
            feedback: feedbackId,
            userid: isAnonymous ? 0 : -1, // Placeholder, actual user ID set by server
            timemodified: Math.floor(Date.now() / 1000),
            random_response: 0,
            anonymous_response: isAnonymous ? 1 : 0,
            courseid: courseId || 0,
          },
          values: Object.entries(responses)
            .filter(([key]) => !isNaN(parseInt(key, 10)))
            .map(([key, value]) => ({
              itemId: parseInt(key, 10),
              value: String(value),
            })),
          isTemporary: false,
        };

        setSubmissionResponse(response);
        announce('Feedback submitted successfully. Thank you for your response.');
        toast.success('Feedback submitted successfully!');

        if (onSubmit) {
          onSubmit(response);
        }
      } else {
        throw new Error(result.data?.message || 'Failed to submit feedback');
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to submit feedback. Please try again.';
      setSubmitError(errorMessage);
      announce(`Submission failed: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, feedbackId, courseId, isAnonymous, onSubmit, toast, announce]);

  /**
   * Retries a failed submission.
   */
  const handleRetrySubmit = useCallback(() => {
    setSubmitError(null);
    handleSubmit(handleFormSubmit)();
  }, [handleSubmit, handleFormSubmit]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Autosave effect - saves draft every 60 seconds if form is dirty
  useEffect(() => {
    if (!isDirty || isSubmitting || isSubmitSuccess) {
      return;
    }

    const autosaveTimer = setInterval(() => {
      handleSaveDraft();
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(autosaveTimer);
  }, [isDirty, isSubmitting, isSubmitSuccess, handleSaveDraft]);

  // Update total pages when pages change
  useEffect(() => {
    setPageState(prev => ({
      ...prev,
      totalPages: pages.length,
      validatedPages: new Array(pages.length).fill(false),
    }));
  }, [pages.length]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Renders a single question item using QuestionRenderer.
   */
  const renderQuestion = (item: ParsedFeedbackItem): React.ReactNode => {
    // Skip non-value items
    if (!item.hasvalue || item.typ === 'pagebreak') {
      if (item.typ === 'info' || item.typ === 'label') {
        return (
          <Box key={item.id} sx={{ mb: 2 }}>
            <Typography
              variant="body1"
              dangerouslySetInnerHTML={{
                __html: item.presentation.info?.content || item.name,
              }}
            />
          </Box>
        );
      }
      return null;
    }

    const fieldKey = `item_${item.id}`;
    const fieldError = errors[fieldKey]?.message as string | undefined;
    const isTouched = !!touchedFields[fieldKey];

    return (
      <Controller
        key={item.id}
        name={fieldKey}
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 3 }}>
            <QuestionRenderer
              id={item.id}
              type={item.typ}
              presentation={item.presentation}
              required={item.required}
              position={item.position}
              label={item.name || item.label}
              value={field.value}
              onChange={field.onChange}
              error={fieldError}
              touched={isTouched}
            />
          </Box>
        )}
      />
    );
  };

  /**
   * Renders the current page of questions.
   */
  const renderCurrentPage = (): React.ReactNode => {
    const currentPageData = pages[pageState.currentPage];
    if (!currentPageData) {
      return (
        <Alert
          severity="error"
          message="Page not found. Please try navigating to a different page."
        />
      );
    }

    return (
      <Box role="region" aria-label={`Page ${pageState.currentPage + 1} questions`}>
        {currentPageData.items.map(item => renderQuestion(item))}
      </Box>
    );
  };

  /**
   * Renders the review page with summary of all answers.
   */
  const renderReviewPage = (): React.ReactNode => {
    const values = getValues();

    return (
      <Box role="region" aria-label="Review your answers">
        <Typography variant="h6" component="h2" gutterBottom>
          Review Your Answers
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Please review your answers before submitting. You can go back to any page to make changes.
        </Typography>

        <Stack spacing={2}>
          {pages.map((page, pageIndex) => (
            <Card key={pageIndex} variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Page {pageIndex + 1}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {page.items
                  .filter(item => item.hasvalue && item.typ !== 'info' && item.typ !== 'label')
                  .map(item => {
                    const fieldKey = `item_${item.id}`;
                    const value = values[fieldKey];
                    let displayValue: string;

                    if (Array.isArray(value)) {
                      displayValue = value.length > 0 ? value.join(', ') : 'No selection';
                    } else if (value !== undefined && value !== '') {
                      displayValue = String(value);
                    } else {
                      displayValue = 'No response';
                    }

                    return (
                      <Box key={item.id} sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item.name || item.label}
                          {item.required === 1 && ' *'}
                        </Typography>
                        <Typography variant="body1">
                          {displayValue}
                        </Typography>
                      </Box>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  };

  /**
   * Renders the success message after submission.
   */
  const renderSuccessMessage = (): React.ReactNode => {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
        }}
        role="status"
        aria-live="polite"
      >
        <CheckCircle
          sx={{ fontSize: 64, color: 'success.main', mb: 2 }}
          aria-hidden="true"
        />
        <Typography variant="h5" gutterBottom>
          Thank You!
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Your feedback has been submitted successfully.
          {isAnonymous && ' Your response was recorded anonymously.'}
        </Typography>
        <Alert
          severity="success"
          message="Your feedback has been recorded. Thank you for taking the time to share your thoughts."
        />
        {onCancel && (
          <Button
            variant="contained"
            onClick={onCancel}
            sx={{ mt: 3 }}
          >
            Return to Course
          </Button>
        )}
      </Box>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  // Show success message if submission was successful
  if (isSubmitSuccess) {
    return renderSuccessMessage();
  }

  const isFirstPage = pageState.currentPage === 0 && !pageState.isReviewPage;
  const isLastPage = pageState.currentPage === pageState.totalPages - 1;
  const showPrevButton = !isFirstPage;
  const showNextButton = !pageState.isReviewPage;
  const showSubmitButton = pageState.isReviewPage;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      sx={{ width: '100%' }}
    >
      {/* Screen reader announcements */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </Box>

      {/* Anonymous mode indicator */}
      {isAnonymous && (
        <Alert
          severity="info"
          message="This feedback is anonymous. Your identity will not be recorded with your response."
          sx={{ mb: 3 }}
        />
      )}

      {/* Progress stepper */}
      {pages.length > 1 && (
        <Box sx={{ mb: 4 }}>
          <Stepper
            activeStep={pageState.isReviewPage ? pages.length : pageState.currentPage}
            alternativeLabel
          >
            {pages.map((_, index) => (
              <Step
                key={index}
                completed={pageState.validatedPages[index] || index < pageState.currentPage}
              >
                <StepLabel>
                  <Typography variant="caption">
                    Page {index + 1}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
            <Step>
              <StepLabel>
                <Typography variant="caption">Review</Typography>
              </StepLabel>
            </Step>
          </Stepper>
        </Box>
      )}

      {/* Page indicator */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {pageState.isReviewPage
            ? 'Review Page'
            : `Page ${pageState.currentPage + 1} of ${pageState.totalPages}`}
        </Typography>
        {lastAutoSave && (
          <Typography variant="caption" color="text.secondary">
            Last saved: {lastAutoSave.toLocaleTimeString()}
          </Typography>
        )}
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={
          pageState.isReviewPage
            ? 100
            : ((pageState.currentPage + 1) / (pageState.totalPages + 1)) * 100
        }
        sx={{ mb: 3, height: 8, borderRadius: 1 }}
        aria-label={`Progress: ${pageState.isReviewPage ? 100 : Math.round(((pageState.currentPage + 1) / (pageState.totalPages + 1)) * 100)}%`}
      />

      {/* Main content area */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, backgroundColor: 'background.default' }}>
        {/* Loading overlay for submission */}
        {isSubmitting && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 10,
            }}
          >
            <LoadingSpinner message="Submitting your feedback..." />
          </Box>
        )}

        {/* Error alert */}
        {submitError && (
          <Alert
            severity="error"
            title="Submission Failed"
            message={submitError}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleRetrySubmit}
              >
                Retry
              </Button>
            }
            sx={{ mb: 3 }}
          />
        )}

        {/* Page content */}
        {pageState.isReviewPage ? renderReviewPage() : renderCurrentPage()}
      </Paper>

      {/* Navigation buttons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {/* Left side: Previous and Save Draft */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {showPrevButton && (
            <Button
              variant="outlined"
              startIcon={<NavigateBefore />}
              onClick={handlePreviousPage}
              disabled={isSubmitting}
              aria-label="Go to previous page"
            >
              Previous
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={isSavingDraft ? <CircularProgress size={16} /> : <Save />}
            onClick={handleSaveDraft}
            disabled={isSubmitting || isSavingDraft}
            aria-label="Save draft"
          >
            {isSavingDraft ? 'Saving...' : 'Save Draft'}
          </Button>
        </Box>

        {/* Right side: Next or Submit */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onCancel && (
            <Button
              variant="text"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          {showNextButton && (
            <Button
              variant="contained"
              endIcon={<NavigateNext />}
              onClick={handleNextPage}
              disabled={isSubmitting}
              aria-label={
                isLastPage
                  ? 'Review your answers'
                  : `Go to page ${pageState.currentPage + 2}`
              }
            >
              {isLastPage ? 'Review' : 'Next'}
            </Button>
          )}
          {showSubmitButton && (
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <Send />
                )
              }
              disabled={isSubmitting || !canSubmit}
              aria-label="Submit feedback"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Keyboard navigation help text */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 2, display: 'block' }}
      >
        Use Tab to navigate between fields. Press Enter to submit or navigate.
      </Typography>
    </Box>
  );
}
